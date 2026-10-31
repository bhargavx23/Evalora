import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ScrollMotionObserver } from './hooks/useScrollMotion';

// Layouts
import { AppLayout } from './layouts/AppLayout';
import { PublicLayout } from './layouts/PublicLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { CollegeRegisterPage } from './pages/public/CollegeRegisterPage';
import { MobileWalletApprovePage } from './pages/public/MobileWalletApprovePage';
import { PricingPage } from './pages/public/PricingPage';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { MyAssessments } from './pages/student/MyAssessments';
import { AssessmentRoom } from './pages/student/AssessmentRoom';
import { PracticeSetup } from './pages/student/PracticeSetup';
import { PracticeRoom } from './pages/student/PracticeRoom';
import { PracticeResults } from './pages/student/PracticeResults';
import { SkillProfile } from './pages/student/SkillProfile';
import { QuestionHistory } from './pages/student/QuestionHistory';
import { ProfilePage } from './pages/student/ProfilePage';
import { CareerPage } from './pages/student/CareerPage';
import { SettingsPage } from './pages/student/SettingsPage';
import { DomainExploration } from './pages/student/DomainExploration';
import { DomainLearningPath } from './pages/student/DomainLearningPath';
import { DomainCodingWorkspace } from './pages/student/DomainCodingWorkspace';
import { DomainProjectWorkspace } from './pages/student/DomainProjectWorkspace';
import { DomainPracticeSession } from './pages/student/DomainPracticeSession';
import { DomainAssessmentRoom } from './pages/student/DomainAssessmentRoom';
import { DedicatedCodeVisualizer } from './pages/student/DedicatedCodeVisualizer';

// Faculty Pages
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { AssessmentManager } from './pages/faculty/AssessmentManager';
import { AssessmentWizard } from './pages/faculty/AssessmentWizard';
import { QuestionBank } from './pages/faculty/QuestionBank';
import { CreateQuestion } from './pages/faculty/CreateQuestion';
import { AIQuestionGenerator } from './pages/faculty/AIQuestionGenerator';
import { LiveAssessmentMonitor } from './pages/faculty/LiveAssessmentMonitor';
import { CodeSimilarityViewer } from './pages/faculty/CodeSimilarityViewer';
import { BatchAnalytics } from './pages/faculty/BatchAnalytics';
import { QuestionAnalytics } from './pages/faculty/QuestionAnalytics';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { DepartmentManager } from './pages/admin/DepartmentManager';
import { UserManager } from './pages/admin/UserManager';
import { PlatformDashboard } from './pages/admin/PlatformDashboard';
import { AdminPortal } from './pages/admin/AdminPortal';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles
}) => {
  const { user, isLoading, authStatus } = useAuth();
  const location = useLocation();

  if (isLoading || authStatus === "initializing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || authStatus === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (allowedRoles) {
    const effectiveRoles = [...allowedRoles];
    if (effectiveRoles.includes('platform_admin') && !effectiveRoles.includes('admin')) {
      effectiveRoles.push('admin');
    }
    if (effectiveRoles.includes('admin') && !effectiveRoles.includes('platform_admin')) {
      effectiveRoles.push('platform_admin');
    }

    if (!effectiveRoles.includes(user.role)) {
      // Redirect to default home for their role
      if (user.role === 'student') return <Navigate to="/dashboard" replace />;
      if (user.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
      if (user.role === 'college_admin') return <Navigate to="/admin/dashboard" replace />;
      if (user.role === 'platform_admin' || user.role === 'admin') return <Navigate to="/admin" replace />;
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export function App() {
  return (
    <BrowserRouter>
      <ScrollMotionObserver />
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Layout */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/college-register" element={<CollegeRegisterPage />} />
              <Route path="/wallet-qr-approve" element={<MobileWalletApprovePage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/subscription" element={<PricingPage />} />
            </Route>

            {/* Assessment Room: Fullscreen Focus View */}
            <Route
              path="/assessments/:id"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'platform_admin']}>
                  <AssessmentRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessments/:id/room"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'platform_admin']}>
                  <AssessmentRoom />
                </ProtectedRoute>
              }
            />

            {/* Practice Room: Fullscreen Focus View */}
            <Route
              path="/practice/:id"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'platform_admin']}>
                  <PracticeRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/practice/:id/room"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'platform_admin']}>
                  <PracticeRoom />
                </ProtectedRoute>
              }
            />

            {/* Domain Focus Workspaces */}
            <Route
              path="/domains/:slug/workspace"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'platform_admin']}>
                  <DomainCodingWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains/:slug/projects/:projectId"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'platform_admin']}>
                  <DomainProjectWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains/:slug/assessment/:assessmentId"
              element={
                <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'platform_admin']}>
                  <DomainAssessmentRoom />
                </ProtectedRoute>
              }
            />

            {/* Standard Dashboard Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Student Routes */}
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/assessments" element={<MyAssessments />} />
              <Route path="/domains" element={<DomainExploration />} />
              <Route path="/domains/:slug" element={<DomainLearningPath />} />
              <Route path="/domains/:slug/practice" element={<DomainPracticeSession />} />
              <Route path="/practice" element={<PracticeSetup />} />
              <Route path="/practice/:id/results" element={<PracticeResults />} />
              <Route path="/skills" element={<SkillProfile />} />
              <Route path="/results" element={<QuestionHistory />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/career" element={<CareerPage />} />
              <Route path="/code-visualizer" element={<DedicatedCodeVisualizer />} />
              <Route path="/visualizer" element={<Navigate to="/code-visualizer" replace />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Faculty Routes */}
              <Route
                path="/faculty/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <FacultyDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/assessments"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <AssessmentManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/assessments/new"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <AssessmentWizard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/questions"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <QuestionBank />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/questions/new"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <CreateQuestion />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/ai-generator"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <AIQuestionGenerator />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/live-monitor"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <LiveAssessmentMonitor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/similarity"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <CodeSimilarityViewer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/batch-analytics"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <BatchAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faculty/question-analytics"
                element={
                  <ProtectedRoute allowedRoles={['faculty', 'college_admin', 'platform_admin']}>
                    <QuestionAnalytics />
                  </ProtectedRoute>
                }
              />

              {/* College Admin Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['college_admin', 'platform_admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/departments"
                element={
                  <ProtectedRoute allowedRoles={['college_admin', 'platform_admin']}>
                    <DepartmentManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['college_admin', 'platform_admin']}>
                    <UserManager />
                  </ProtectedRoute>
                }
              />

              {/* Platform Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'platform_admin']}>
                    <AdminPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'platform_admin']}>
                    <PlatformDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/colleges"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'platform_admin']}>
                    <PlatformDashboard />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
