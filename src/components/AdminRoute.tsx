import { Navigate, Outlet } from 'react-router-dom';
import { isAdminUser, isLoggedIn } from '../services/authStore';

export default function AdminRoute() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (!isAdminUser()) return <Navigate to="/account" replace />;
  return <Outlet />;
}
