import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ExtinguisherForm from './pages/ExtinguisherForm'
import ExtinguisherList from './pages/ExtinguisherList'
import InspectSession from './pages/InspectSession'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'
import ExtinguisherDetail from './pages/ExtinguisherDetail'
import MyAccount from './pages/MyAccount'
import NotFound from './pages/NotFound'

function PrivateRoute({ children, roles }) {
  const { user, profile } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(profile?.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/extinguishers" element={<PrivateRoute><ExtinguisherList /></PrivateRoute>} />
      <Route path="/extinguishers/new" element={<PrivateRoute roles={['admin','superadmin']}><ExtinguisherForm /></PrivateRoute>} />
      <Route path="/extinguishers/:id" element={<PrivateRoute roles={['admin','superadmin']}><ExtinguisherDetail /></PrivateRoute>} />
      <Route path="/inspect" element={<PrivateRoute><InspectSession /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute roles={['admin','superadmin']}><UserManagement /></PrivateRoute>} />
      <Route path="/account" element={<PrivateRoute><MyAccount /></PrivateRoute>} />
      <Route path="*" element={<NotFound/>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
