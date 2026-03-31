import { Navigate } from "react-router-dom";

// "/" is handled by the Dashboard route — this component just redirects if hit directly
export default function Index() {
  return <Navigate to="/" replace />;
}
