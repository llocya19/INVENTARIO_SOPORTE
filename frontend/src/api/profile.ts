import http from "./http";

export async function getProfile() {
  const { data } = await http.get<{ username: string; rol: string; email: string | null }>("/api/profile");
  return data;
}

export async function updateEmail(email: string) {
  await http.patch("/api/profile", { email });
}

export async function sendTestMail() {
  await http.post("/api/profile/send-test", {});
}
