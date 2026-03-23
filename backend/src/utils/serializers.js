const { formatDateOnly } = require("./time");

function serializeAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function serializeDoctor(doctor) {
  return {
    id: doctor.id,
    userId: doctor.userId,
    name: doctor.user.name,
    email: doctor.user.email,
    specialization: doctor.specialization,
  };
}

function serializeSchedule(schedule) {
  return {
    id: schedule.id,
    doctorId: schedule.doctorId,
    mode: schedule.mode,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  };
}

function serializeDayOff(dayOff) {
  return {
    id: dayOff.id,
    doctorId: dayOff.doctorId,
    date: formatDateOnly(dayOff.date),
  };
}

function serializePatientAppointment(appointment) {
  return {
    id: appointment.id,
    date: formatDateOnly(appointment.date),
    time: appointment.time,
    status: appointment.status,
    doctor: {
      id: appointment.doctor.id,
      name: appointment.doctor.user.name,
      email: appointment.doctor.user.email,
      specialization: appointment.doctor.specialization,
    },
  };
}

function serializeDoctorAppointment(appointment) {
  return {
    id: appointment.id,
    date: formatDateOnly(appointment.date),
    time: appointment.time,
    status: appointment.status,
    patient: {
      id: appointment.patient.id,
      name: appointment.patient.name,
      email: appointment.patient.email,
    },
  };
}

module.exports = {
  serializeAuthUser,
  serializeDoctor,
  serializeDayOff,
  serializeDoctorAppointment,
  serializePatientAppointment,
  serializeSchedule,
};
