import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { DEV_ACADEMIAS_CHANGED } from "../lib/devAcademias";

export interface AcademiaBilling {
  plano: string;
  periodo: string;
  formaPagamento: string;
}

export interface AcademiaOwner {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
}

export interface DevAcademia {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  createdAt: string;
  owner: AcademiaOwner | null;
  billing: AcademiaBilling;
}

export function useDevAcademias() {
  const location = useLocation();
  const [academias, setAcademias] = useState<DevAcademia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");

    apiFetch<{ academias: DevAcademia[] }>("/dev/academias")
      .then((data) => setAcademias(data.academias))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar academias."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload, location.pathname]);

  useEffect(() => {
    const handleChange = () => reload();
    window.addEventListener(DEV_ACADEMIAS_CHANGED, handleChange);
    return () => window.removeEventListener(DEV_ACADEMIAS_CHANGED, handleChange);
  }, [reload]);

  return { academias, loading, error, reload };
}
