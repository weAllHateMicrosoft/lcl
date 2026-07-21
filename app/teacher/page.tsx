import { redirect } from "next/navigation";

// The old teacher dashboard has moved into the per-class workspace (/class).
export default function TeacherIndexRedirect() {
  redirect("/class");
}
