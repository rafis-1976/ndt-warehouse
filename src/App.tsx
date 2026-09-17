import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './components/auth/LoginForm';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Equipos } from './pages/Equipos';
import { Prestamos } from './pages/Prestamos';
import { Calibraciones } from './pages/Calibraciones';
import { Estadisticas } from './pages/Estadisticas';
import { Scan } from './pages/Scan';
import { Movimientos } from './pages/Movimientos';
import { Usuarios } from './pages/Usuarios';
import { UsuarioNuevo } from './pages/UsuarioNuevo';
import { Carros } from './pages/Carros';
import { Probetas } from './pages/Probetas';
import { Informes } from './pages/Informes';

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col">
      <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
        } />
        <Route path="/equipos" element={
          <ProtectedRoute><Layout><Equipos /></Layout></ProtectedRoute>
        } />
        <Route path="/carros" element={
          <ProtectedRoute><Layout><Carros /></Layout></ProtectedRoute>
        } />
        <Route path="/probetas" element={
          <ProtectedRoute><Layout><Probetas /></Layout></ProtectedRoute>
        } />
        <Route path="/informes" element={
          <ProtectedRoute><Layout><Informes /></Layout></ProtectedRoute>
        } />
        <Route path="/prestamos" element={
          <ProtectedRoute><Layout><Prestamos /></Layout></ProtectedRoute>
        } />
        <Route path="/calibraciones" element={
          <ProtectedRoute><Layout><Calibraciones /></Layout></ProtectedRoute>
        } />
        <Route path="/movimientos" element={
          <ProtectedRoute><Layout><Movimientos /></Layout></ProtectedRoute>
        } />
        <Route path="/scan" element={
          <ProtectedRoute><Layout><Scan /></Layout></ProtectedRoute>
        } />
        <Route path="/estadisticas" element={
          <ProtectedRoute><Layout><Estadisticas /></Layout></ProtectedRoute>
        } />
        <Route path="/usuarios" element={
          <ProtectedRoute><Layout><Usuarios /></Layout></ProtectedRoute>
        } />
        <Route path="/usuarios/nuevo" element={
          <ProtectedRoute><Layout><UsuarioNuevo /></Layout></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}