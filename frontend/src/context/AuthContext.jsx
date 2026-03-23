import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "hospital-appointment-auth";
const AuthContext = createContext(null);

function getStorage(type) {
  try {
    return window[type];
  } catch (error) {
    return null;
  }
}

function readStoredSession() {
  const sessionStorageRef = getStorage("sessionStorage");
  const localStorageRef = getStorage("localStorage");

  const sessionValue = sessionStorageRef?.getItem(STORAGE_KEY);

  if (sessionValue) {
    try {
      return JSON.parse(sessionValue);
    } catch (error) {
      sessionStorageRef.removeItem(STORAGE_KEY);
    }
  }

  const legacyValue = localStorageRef?.getItem(STORAGE_KEY);

  if (!legacyValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(legacyValue);

    // Migrate the old shared browser session into the current tab only.
    sessionStorageRef?.setItem(STORAGE_KEY, JSON.stringify(parsedValue));
    localStorageRef?.removeItem(STORAGE_KEY);

    return parsedValue;
  } catch (error) {
    localStorageRef?.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getDashboardPathForRole(role) {
  switch (role) {
    case "PATIENT":
      return "/patient";
    case "DOCTOR":
      return "/doctor";
    case "ADMIN":
      return "/admin";
    default:
      return "/login";
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredSession);

  function saveAuthSession(session) {
    const sessionStorageRef = getStorage("sessionStorage");
    const localStorageRef = getStorage("localStorage");

    sessionStorageRef?.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorageRef?.removeItem(STORAGE_KEY);
    setAuth(session);
  }

  function clearAuthSession() {
    const sessionStorageRef = getStorage("sessionStorage");
    const localStorageRef = getStorage("localStorage");

    sessionStorageRef?.removeItem(STORAGE_KEY);
    localStorageRef?.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  return (
    <AuthContext.Provider
      value={{
        auth,
        saveAuthSession,
        clearAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
