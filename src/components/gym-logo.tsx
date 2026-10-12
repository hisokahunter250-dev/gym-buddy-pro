import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_GYM_LOGO, gymLogoOptions } from "@/lib/gym-logo";

export function GymLogo({ className }: { className?: string }) {
  const { data = DEFAULT_GYM_LOGO } = useQuery(gymLogoOptions);
  const [source, setSource] = useState(data);
  useEffect(() => setSource(data), [data]);
  return <img src={source} alt="شعار الجيم" className={className} onError={() => {
    setSource(source === DEFAULT_GYM_LOGO ? "/favicon.png" : DEFAULT_GYM_LOGO);
  }} />;
}