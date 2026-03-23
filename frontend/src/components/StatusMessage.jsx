function StatusMessage({ notice }) {
  if (!notice?.text) {
    return null;
  }

  return <div className={`notice notice-${notice.type || "info"}`}>{notice.text}</div>;
}

export default StatusMessage;

