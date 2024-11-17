import NotFoundPage from '@/pages/not-found'
import RootLayout from '@/root-layout'
import { taskQueryOptions, tasksQueryOptions } from '@/services/api-tasks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  RouterProvider
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { lazy } from 'react'
import { setTheme } from './lib/set-theme'
import ForgotPasswordPage from './pages/auth/forgot-password'
import LoginPage from './pages/auth/login'
import RegisterPage from './pages/auth/register'
import ResetPasswordPage from './pages/auth/reset-password'
import VerifyEmailPage from './pages/auth/verify-email'
import ErrorPage from './pages/error'
import HomePage from './pages/home'
import {
  resetPasswordParamsSchema,
  verifyEmailParamsSchema
} from './schemas/auth-schema'
import { pbIdSchema } from './schemas/pb-schema'
import {
  checkEmailIsVerified,
  checkUserIsAuthenticated,
  checkUserIsLoggedIn,
  userQueryOptions
} from './services/api-auth'

const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(userQueryOptions),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = queryClient.getQueryData(userQueryOptions.queryKey)
    setTheme(user?.settings?.theme)
  }
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  beforeLoad: async () => {
    if (checkUserIsAuthenticated()) throw redirect({ to: '/tasks' })
  }
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: ({ location }) => {
    if (
      checkUserIsAuthenticated() &&
      !location.pathname.includes('reset-password')
    )
      throw redirect({ to: '/tasks' })
  }
})

const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: () => {
    if (checkUserIsLoggedIn() && !checkEmailIsVerified())
      throw redirect({ to: '/verify-email' })
  }
})

const registerRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/register',
  component: RegisterPage,
  beforeLoad: () => {
    if (checkUserIsLoggedIn() && !checkEmailIsVerified())
      throw redirect({ to: '/verify-email' })
  }
})

const verifyEmailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/verify-email',
  component: VerifyEmailPage,
  validateSearch: verifyEmailParamsSchema
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
  beforeLoad: () => {
    if (checkUserIsLoggedIn() && !checkEmailIsVerified())
      throw redirect({ to: '/verify-email' })
  }
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/reset-password',
  component: ResetPasswordPage,
  validateSearch: resetPasswordParamsSchema
})

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tasks',
  component: lazy(() => import('./pages/tasks/tasks')),
  beforeLoad: () => {
    if (!checkUserIsAuthenticated()) throw redirect({ to: '/login' })
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(tasksQueryOptions)
})

const settingsRoute = createRoute({
  getParentRoute: () => tasksRoute,
  path: 'settings',
  component: lazy(() => import('./pages/settings'))
})

const newTaskRoute = createRoute({
  getParentRoute: () => tasksRoute,
  path: 'new',
  component: lazy(() => import('./pages/tasks/new-task'))
})

const editTaskRoute = createRoute({
  getParentRoute: () => tasksRoute,
  path: '$taskId',
  component: lazy(() => import('./pages/tasks/edit-task')),
  loader: ({ context: { queryClient }, params: { taskId } }) => {
    const taskIdValidationResult = pbIdSchema.safeParse(taskId)
    if (taskIdValidationResult.error) throw redirect({ to: '/tasks' })
    return queryClient.ensureQueryData(
      taskQueryOptions(taskIdValidationResult.data)
    )
  }
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  authRoute.addChildren([
    loginRoute,
    registerRoute,
    verifyEmailRoute,
    forgotPasswordRoute,
    resetPasswordRoute
  ]),
  tasksRoute.addChildren([settingsRoute, newTaskRoute, editTaskRoute])
])

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  context: { queryClient }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function Router({
  devToolsEnabled
}: {
  devToolsEnabled?: boolean
}) {
  devToolsEnabled ??= process.env.NODE_ENV === 'development'

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {devToolsEnabled && (
        <>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition='bottom-left'
          />
          <TanStackRouterDevtools router={router} position='bottom-right' />
        </>
      )}
    </QueryClientProvider>
  )
}
