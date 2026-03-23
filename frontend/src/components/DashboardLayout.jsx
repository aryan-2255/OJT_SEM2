import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function DashboardLayout({ title, subtitle, children }) {
  const navigate = useNavigate();
  const { auth, clearAuthSession } = useAuth();

  function handleLogout() {
    clearAuthSession();
    navigate("/login");
  }

  return (
    <div className="page-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Single Hospital System</p>
          <h1>{title}</h1>
          <p className="hero-copy">{subtitle}</p>
        </div>

        <div className="profile-panel">
          <span className="role-pill">{auth.user.role}</span>
          <strong>{auth.user.name}</strong>
          <span>{auth.user.email}</span>
          <button className="secondary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-grid">{children}</main>
    </div>
  );
}

export default DashboardLayout;

