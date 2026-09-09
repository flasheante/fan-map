// Fecha + hora del badge "Actualizado" del historial de shows (ver
// TourExplorer). A diferencia de formatShowDate (format-show-date.ts), acá
// SÍ importa la hora real y corre en el huso horario de quien mira la
// pantalla, no en UTC fijo: setlistsSyncedAt es un instante real (cuándo
// terminó la última corrida del sync), no una fecha "sin hora" como
// show.date.
const syncedAtFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatSyncedAt(dateIso: string): string {
  return syncedAtFormatter.format(new Date(dateIso));
}
