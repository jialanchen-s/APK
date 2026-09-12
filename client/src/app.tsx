import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import EstimateWorkbench from './pages/EstimateWorkbench/EstimateWorkbench';
import BatchFill from './pages/BatchFill/BatchFill';
import ContractArchive from './pages/ContractArchive/ContractArchive';
import PriceQuery from './pages/PriceQuery/PriceQuery';
import ModelStudio from './pages/ModelStudio/ModelStudio';
import AgentChat from './pages/AgentChat/AgentChat';
import RoleManagementPage from './pages/RoleManagementPage/RoleManagementPage';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ProtectedRoute requiredPermissions={[{ action: 'create', subject: 'EstimateTask' }]}><EstimateWorkbench /></ProtectedRoute>} />
        <Route path="batch-fill" element={<ProtectedRoute requiredPermissions={[{ action: 'update', subject: 'PendingItem' }]}><BatchFill /></ProtectedRoute>} />
        <Route path="contract-archive" element={<ProtectedRoute requiredPermissions={[{ action: 'read', subject: 'ContractArchive' }]}><ContractArchive /></ProtectedRoute>} />
        <Route path="price-query" element={<ProtectedRoute requiredPermissions={[{ action: 'read', subject: 'PriceQuery' }]}><PriceQuery /></ProtectedRoute>} />
        <Route path="model-studio" element={<ProtectedRoute requiredPermissions={[{ action: 'read', subject: 'Model' }]}><ModelStudio /></ProtectedRoute>} />
        <Route path="agent" element={<ProtectedRoute requiredPermissions={[{ action: 'use', subject: 'Agent' }]}><AgentChat /></ProtectedRoute>} />
        <Route path="role-management" element={<ProtectedRoute requiredPermissions={[{ action: 'manage', subject: 'Permission' }]}><RoleManagementPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
