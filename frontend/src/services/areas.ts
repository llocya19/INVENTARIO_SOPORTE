import { api, safe } from "../utils/api";

export const listAreas = () => safe(api.get("/api/areas/list"));
export const treeAreas = () => safe(api.get("/api/areas/tree"));
export const upsertArea = (area_nombre: string, area_padre_nombre?: string) =>
  safe(api.post("/api/areas/upsert", { area_nombre, area_padre_nombre }));
