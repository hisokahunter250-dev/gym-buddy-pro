import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "إدارة الجيم - الرئيسية" }, { name: "description", content: "إدارة أعضاء الجيم والحضور والاشتراكات." }, { property: "og:title", content: "إدارة الجيم - الرئيسية" }, { property: "og:description", content: "إدارة أعضاء الجيم والحضور والاشتراكات." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/attendance" });
  },
});
