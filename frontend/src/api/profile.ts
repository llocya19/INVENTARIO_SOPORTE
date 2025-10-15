import http from "../api/http";

export async function getProfile() {
  const r = await http.get<{ username: string; rol: string; email: string | null }>("/api/profile");
  return r.data;
}

export async function updateEmail(email: string) {
  await http.patch("/api/profile", { email });
}

export async function sendTestMail() {
  await http.post("/api/profile/send-test", {});
}
