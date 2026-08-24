// timeZone: "UTC" porque show.date llega como medianoche UTC (fecha sin
// hora real asociada); formatear en el huso del navegador podría correr el
// día mostrado. Compartido por ShowDetail y TourBreadcrumbs (ver también
// ShowsList, que mantiene su propia instancia equivalente).
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function formatShowDate(dateIso: string): string {
  return dateFormatter.format(new Date(dateIso));
}
