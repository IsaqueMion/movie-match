import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import './index.css'

import Landing from './pages/Landing'
import CreateSession from './pages/CreateSession'
import JoinSession from './pages/JoinSession'
import Swipe from './pages/Swipe'
import Matches from './pages/Matches'
import AppError from './pages/AppError' // crie este arquivo se ainda não existir

function RootLayout() {
  return <Outlet />
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <AppError />, // fallback bonito de erro/404
    children: [
      { path: '/', element: <Landing /> },
      { path: '/create', element: <CreateSession /> },
      { path: '/join', element: <JoinSession /> },
      // use a rota que o app já referencia:
      { path: '/s/:code', element: <Swipe /> },
      { path: '/s/:code/matches', element: <Matches /> },
      // catch-all
      { path: '*', element: <AppError /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

