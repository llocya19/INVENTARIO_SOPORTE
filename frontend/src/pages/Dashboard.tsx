// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import http from "../api/http";

type Counts = {
  areas:number; equipos:number; componentes:number; perifericos:number; en_almacen:number; en_uso:number;
};

export default function Dashboard() {
  const [data, setData] = useState<Counts | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    http.get("/api/reports/counts").then(r=>setData(r.data)).catch(e=>{
      setErr(e?.response?.data?.error || "No se pudo cargar");
    });
  }, []);

  if (err) return <div className="container py-4"><div className="alert alert-danger">{err}</div></div>;
  if (!data) return <div className="container py-4">Cargando...</div>;

  const cards = [
    { title:"Áreas", value:data.areas },
    { title:"Equipos", value:data.equipos },
    { title:"Componentes", value:data.componentes },
    { title:"Periféricos", value:data.perifericos },
    { title:"En almacén", value:data.en_almacen },
    { title:"En uso", value:data.en_uso },
  ];

  return (
    <div className="container py-4">
      <h4 className="mb-3">Panel General</h4>
      <div className="row g-3">
        {cards.map((c, i)=>(
          <div className="col-12 col-sm-6 col-md-4" key={i}>
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="small text-muted">{c.title}</div>
                <div className="h3 mb-0">{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
