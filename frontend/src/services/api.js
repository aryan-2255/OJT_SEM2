const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001/api";

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();

  return queryString ? `?${queryString}` : "";
}

async function request(path, options = {}, token) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new Error(
      `Unable to reach the API at ${API_URL}. Check that the backend is running and the frontend origin is allowed.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export const authApi = {
  login(payload) {
    return request("/auth/login", { method: "POST", body: payload });
  },
  signup(payload) {
    return request("/auth/signup", { method: "POST", body: payload });
  },
};

export const adminApi = {
  listDoctors(token) {
    return request("/admin/doctors", {}, token);
  },
  createDoctor(token, payload) {
    return request("/admin/doctors", { method: "POST", body: payload }, token);
  },
  updateDoctor(token, doctorId, payload) {
    return request(`/admin/doctors/${doctorId}`, { method: "PUT", body: payload }, token);
  },
  deleteDoctor(token, doctorId) {
    return request(`/admin/doctors/${doctorId}`, { method: "DELETE" }, token);
  },
};

export const doctorApi = {
  listSchedules(token) {
    return request("/doctor/schedules", {}, token);
  },
  createSchedule(token, payload) {
    return request("/doctor/schedules", { method: "POST", body: payload }, token);
  },
  deleteSchedule(token, scheduleId) {
    return request(`/doctor/schedules/${scheduleId}`, { method: "DELETE" }, token);
  },
  listDayOffs(token) {
    return request("/doctor/day-offs", {}, token);
  },
  createDayOff(token, payload) {
    return request("/doctor/day-offs", { method: "POST", body: payload }, token);
  },
  deleteDayOff(token, dayOffId) {
    return request(`/doctor/day-offs/${dayOffId}`, { method: "DELETE" }, token);
  },
  listAppointments(token, query = {}) {
    return request(`/doctor/appointments${buildQueryString(query)}`, {}, token);
  },
};

export const patientApi = {
  listDoctors(token) {
    return request("/patient/doctors", {}, token);
  },
  getSlots(token, doctorId, date) {
    return request(`/patient/doctors/${doctorId}/slots?date=${encodeURIComponent(date)}`, {}, token);
  },
  listAppointments(token, query = {}) {
    return request(`/patient/appointments${buildQueryString(query)}`, {}, token);
  },
  bookAppointment(token, payload) {
    return request("/patient/appointments", { method: "POST", body: payload }, token);
  },
  cancelAppointment(token, appointmentId) {
    return request(`/patient/appointments/${appointmentId}/cancel`, { method: "PATCH" }, token);
  },
};
