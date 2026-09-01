import { Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { MemberShell } from "./components/layout/MemberShell";
import { AdminShell } from "./components/layout/AdminShell";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireMemberSetup } from "./components/auth/RequireMemberSetup";
import { RequireRole } from "./components/auth/RequireRole";
import AdminPage from "./pages/AdminPage";
import AdminActivitiesPage from "./pages/AdminActivitiesPage";
import AdminStaffPage from "./pages/AdminStaffPage";
import AdminRequirementsPage from "./pages/AdminRequirementsPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MemberPage from "./pages/MemberPage";
import MemberSetupPage from "./pages/MemberSetupPage";
import MemberEventsPage from "./pages/MemberEventsPage";
import StaffPage from "./pages/StaffPage";

export const routes = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/change-password",
    element: <ChangePasswordPage />,
  },
  {
    path: "/member/setup",
    element: (
      <RequireAuth>
        <RequireRole allow="member">
          <MemberSetupPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/member",
    element: (
      <RequireAuth>
        <RequireRole allow="member">
          <RequireMemberSetup>
            <MemberShell />
          </RequireMemberSetup>
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <MemberPage />,
      },
      {
        path: "events",
        element: <MemberEventsPage />,
      },
    ],
  },
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireRole allow="admin">
          <AdminShell />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <AdminPage />,
      },
      {
        path: "activities",
        element: <AdminActivitiesPage />,
      },
      {
        path: "requirements",
        element: <AdminRequirementsPage />,
      },
      {
        path: "staff",
        element: <AdminStaffPage />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "staff",
        element: (
          <RequireRole allow="staff">
            <StaffPage />
          </RequireRole>
        ),
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
];
