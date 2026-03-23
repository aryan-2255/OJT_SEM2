import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import SectionCard from "../components/SectionCard";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../context/AuthContext";
import { adminApi } from "../services/api";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  specialization: "",
};

function AdminDashboard() {
  const { auth } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyDoctorId, setBusyDoctorId] = useState(null);
  const [notice, setNotice] = useState(null);

  async function loadDoctors() {
    const response = await adminApi.listDoctors(auth.token);
    setDoctors(response.doctors);
  }

  useEffect(() => {
    async function initializeDashboard() {
      setLoading(true);

      try {
        await loadDoctors();
      } catch (requestError) {
        setNotice({ type: "error", text: requestError.message });
      } finally {
        setLoading(false);
      }
    }

    initializeDashboard();
  }, [auth.token]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingDoctorId(null);
  }

  function handleEditDoctor(doctor) {
    setEditingDoctorId(doctor.id);
    setForm({
      name: doctor.name,
      email: doctor.email,
      password: "",
      specialization: doctor.specialization || "",
    });
    setNotice(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      if (editingDoctorId) {
        await adminApi.updateDoctor(auth.token, editingDoctorId, form);
      } else {
        await adminApi.createDoctor(auth.token, form);
      }

      resetForm();
      await loadDoctors();
      setNotice({
        type: "success",
        text: editingDoctorId
          ? "Doctor account updated successfully."
          : "Doctor account created successfully.",
      });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteDoctor(doctor) {
    const shouldDelete = window.confirm(
      `Delete ${doctor.name}? This will also remove the doctor's schedules and appointments.`
    );

    if (!shouldDelete) {
      return;
    }

    setBusyDoctorId(doctor.id);
    setNotice(null);

    try {
      await adminApi.deleteDoctor(auth.token, doctor.id);

      if (editingDoctorId === doctor.id) {
        resetForm();
      }

      await loadDoctors();
      setNotice({ type: "success", text: "Doctor deleted successfully." });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setBusyDoctorId(null);
    }
  }

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Create, edit, and delete doctor accounts while keeping the hospital roster in sync."
    >
      <div className="full-span">
        <StatusMessage notice={notice} />
      </div>

      <SectionCard title={editingDoctorId ? "Edit Doctor" : "Create Doctor"}>
        <form className="stack gap-sm" onSubmit={handleSubmit}>
          <label>
            Doctor name
            <input
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Dr. Jane Smith"
              required
            />
          </label>

          <label>
            Doctor email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="doctor@hospital.com"
              required
            />
          </label>

          <label>
            {editingDoctorId ? "New password" : "Temporary password"}
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder={
                editingDoctorId ? "Leave blank to keep current password" : "Minimum 6 characters"
              }
              required={!editingDoctorId}
            />
          </label>

          <label>
            Specialization
            <input
              name="specialization"
              type="text"
              value={form.specialization}
              onChange={handleChange}
              placeholder="Cardiology"
            />
          </label>

          <div className="action-row">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? editingDoctorId
                  ? "Saving..."
                  : "Creating..."
                : editingDoctorId
                  ? "Save changes"
                  : "Create doctor"}
            </button>

            {editingDoctorId ? (
              <button type="button" className="secondary-button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Doctors">
        {loading ? (
          <p className="empty-state">Loading doctors...</p>
        ) : doctors.length === 0 ? (
          <p className="empty-state">No doctors have been created yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Specialization</th>
                  <th>Email</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor.id}>
                    <td>{doctor.name}</td>
                    <td>{doctor.specialization || "General"}</td>
                    <td>{doctor.email}</td>
                    <td>
                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleEditDoctor(doctor)}
                          disabled={busyDoctorId === doctor.id}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleDeleteDoctor(doctor)}
                          disabled={busyDoctorId === doctor.id}
                        >
                          {busyDoctorId === doctor.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </DashboardLayout>
  );
}

export default AdminDashboard;
