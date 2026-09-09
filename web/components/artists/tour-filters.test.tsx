import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Country } from "@/lib/api";
import type { TourCityOption, TourFilters } from "@/lib/tour-filters";
import { TourFiltersPanel } from "./tour-filters";

const argentina: Country = { id: "country-ar", name: "Argentina", code: "AR" };
const mexico: Country = { id: "country-mx", name: "México", code: "MX" };
const countries: Country[] = [argentina, mexico];

const mendoza: TourCityOption = {
  id: "city-mendoza",
  name: "Mendoza",
  countryId: argentina.id,
  countryName: argentina.name,
};
const monterrey: TourCityOption = {
  id: "city-mty",
  name: "Monterrey",
  countryId: mexico.id,
  countryName: mexico.name,
};
const cities: TourCityOption[] = [mendoza, monterrey];

const years = [2022, 2023, 2024];

function renderPanel(overrides: Partial<React.ComponentProps<typeof TourFiltersPanel>> = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  const filters: TourFilters = overrides.filters ?? {};

  render(
    <TourFiltersPanel
      filters={filters}
      years={years}
      countries={countries}
      cities={cities}
      onChange={onChange}
      onClear={onClear}
      {...overrides}
    />,
  );

  return { onChange, onClear };
}

describe("TourFiltersPanel", () => {
  it("renders every filter control", () => {
    renderPanel();

    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/año/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/país/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ciudad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeInTheDocument();
  });

  it("lists every available year, country and city as options", () => {
    renderPanel();

    const yearSelect = screen.getByLabelText(/año/i);
    expect(yearSelect).toHaveTextContent("2022");
    expect(yearSelect).toHaveTextContent("2023");
    expect(yearSelect).toHaveTextContent("2024");

    const countrySelect = screen.getByLabelText(/país/i);
    expect(countrySelect).toHaveTextContent("Argentina");
    expect(countrySelect).toHaveTextContent("México");

    const citySelect = screen.getByLabelText(/ciudad/i);
    expect(citySelect).toHaveTextContent("Mendoza");
    expect(citySelect).toHaveTextContent("Monterrey");
  });

  it("disambiguates cities with the same name by showing their country", () => {
    const santiagoChile: TourCityOption = {
      id: "city-santiago-cl",
      name: "Santiago",
      countryId: "country-cl",
      countryName: "Chile",
    };
    const santiagoMexico: TourCityOption = {
      id: "city-santiago-mx",
      name: "Santiago",
      countryId: mexico.id,
      countryName: mexico.name,
    };

    render(
      <TourFiltersPanel
        filters={{}}
        years={years}
        countries={countries}
        cities={[santiagoChile, santiagoMexico]}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const options = screen.getAllByRole("option", { name: /santiago/i });
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent(/santiago.*chile/i);
    expect(options[1]).toHaveTextContent(/santiago.*méxico/i);
  });

  it("shows what was typed immediately, without waiting for the debounce", () => {
    renderPanel({ filters: { year: 2024 } });

    fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: "m" } });

    expect(screen.getByLabelText(/buscar/i)).toHaveValue("m");
  });

  // El campo de búsqueda debouncea antes de llamar a onChange (ver
  // tour-filters.tsx): cada onChange dispara un router.replace real en
  // tour-explorer.tsx, y sin debounce tipear rápido pierde letras (una
  // navegación vieja resuelve después de una más nueva y pisa el input).
  it("calls onChange with the typed search, merged with the existing filters, after the debounce settles", () => {
    vi.useFakeTimers();
    try {
      const { onChange } = renderPanel({ filters: { year: 2024 } });

      fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: "m" } });
      expect(onChange).not.toHaveBeenCalled();

      vi.runAllTimers();

      expect(onChange).toHaveBeenLastCalledWith({ year: 2024, search: "m" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("only propagates the final value when several keystrokes happen within the debounce window", () => {
    vi.useFakeTimers();
    try {
      const { onChange } = renderPanel();
      const search = screen.getByLabelText(/buscar/i);

      fireEvent.change(search, { target: { value: "m" } });
      fireEvent.change(search, { target: { value: "mo" } });
      fireEvent.change(search, { target: { value: "mon" } });

      vi.runAllTimers();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({ search: "mon" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("calls onChange with a numeric year when a year is selected", () => {
    const { onChange } = renderPanel();

    fireEvent.change(screen.getByLabelText(/año/i), { target: { value: "2023" } });

    expect(onChange).toHaveBeenLastCalledWith({ year: 2023 });
  });

  it("calls onChange with the selected countryId", () => {
    const { onChange } = renderPanel();

    fireEvent.change(screen.getByLabelText(/país/i), { target: { value: mexico.id } });

    expect(onChange).toHaveBeenLastCalledWith({ countryId: mexico.id });
  });

  it("calls onChange with the selected cityId", () => {
    const { onChange } = renderPanel();

    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: monterrey.id } });

    expect(onChange).toHaveBeenLastCalledWith({ cityId: monterrey.id });
  });

  it("clears year back to undefined when 'Todos' is selected again", () => {
    const { onChange } = renderPanel({ filters: { year: 2024 } });

    fireEvent.change(screen.getByLabelText(/año/i), { target: { value: "" } });

    expect(onChange).toHaveBeenLastCalledWith({ year: undefined });
  });

  it("calls onChange with dateFrom/dateTo when the date inputs change", () => {
    const { onChange } = renderPanel();

    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: "2024-01-01" } });
    expect(onChange).toHaveBeenLastCalledWith({ dateFrom: "2024-01-01" });

    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: "2025-12-31" } });
    expect(onChange).toHaveBeenLastCalledWith({ dateTo: "2025-12-31" });
  });

  it("calls onClear when the clear button is clicked", () => {
    const { onClear } = renderPanel({ filters: { year: 2024 } });

    fireEvent.click(screen.getByRole("button", { name: /limpiar filtros/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("disables the clear button when there are no active filters", () => {
    renderPanel({ filters: {} });

    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeDisabled();
  });

  it("enables the clear button when at least one filter is active", () => {
    renderPanel({ filters: { search: "monterrey" } });

    expect(screen.getByRole("button", { name: /limpiar filtros/i })).not.toBeDisabled();
  });

  it("reflects the current filters in the controls (controlled component)", () => {
    renderPanel({
      filters: {
        search: "mexico",
        year: 2023,
        countryId: mexico.id,
        cityId: monterrey.id,
        dateFrom: "2024-01-01",
        dateTo: "2025-12-31",
      },
    });

    expect(screen.getByLabelText(/buscar/i)).toHaveValue("mexico");
    expect(screen.getByLabelText(/año/i)).toHaveValue("2023");
    expect(screen.getByLabelText(/país/i)).toHaveValue(mexico.id);
    expect(screen.getByLabelText(/ciudad/i)).toHaveValue(monterrey.id);
    expect(screen.getByLabelText(/desde/i)).toHaveValue("2024-01-01");
    expect(screen.getByLabelText(/hasta/i)).toHaveValue("2025-12-31");
  });

  // Colapso en mobile (ver auditoría de navegación mobile): Año/País/Ciudad/
  // Desde/Hasta arrancan plegados detrás del botón "Filtros" cuando no hay
  // ningún filtro avanzado activo.
  it("starts with the 'Filtros' toggle collapsed when no advanced filter is active", () => {
    renderPanel();

    expect(
      screen.getByRole("button", { name: /^filtros$/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("starts already expanded when an advanced filter arrives active (e.g. from the URL)", () => {
    renderPanel({ filters: { year: 2024 } });

    expect(
      screen.getByRole("button", { name: /ocultar filtros/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles aria-expanded when the 'Filtros' button is clicked", () => {
    renderPanel();

    const toggle = screen.getByRole("button", { name: /^filtros$/i });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /ocultar filtros/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /ocultar filtros/i }));
    expect(screen.getByRole("button", { name: /^filtros$/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("shows a count badge on the 'Filtros' toggle for each active advanced filter, not counting search", () => {
    renderPanel({
      filters: { search: "monterrey", year: 2024, countryId: mexico.id },
    });

    expect(screen.getByRole("button", { name: /ocultar filtros/i })).toHaveTextContent("2");
  });

  it("does not crash when there are no years/countries/cities yet", () => {
    render(
      <TourFiltersPanel
        filters={{}}
        years={[]}
        countries={[]}
        cities={[]}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument();
  });
});
