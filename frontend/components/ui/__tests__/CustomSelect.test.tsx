import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomSelect from "../CustomSelect";

function Harness() {
  const [v, setV] = useState("PETANI");
  return (
    <form onSubmit={e => e.preventDefault()}>
      <CustomSelect
        value={v}
        onChange={setV}
        options={[
          { label: "Petani", value: "PETANI" },
          { label: "UMKM Kuliner", value: "UMKM" },
        ]}
      />
      <span data-testid="val">{v}</span>
    </form>
  );
}

test("dropdown terbuka saat diklik dan opsi bisa dipilih", () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: /pilih opsi|petani/i });

  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(trigger);
  expect(screen.queryByRole("listbox")).not.toBeNull();

  fireEvent.click(screen.getByRole("option", { name: /UMKM Kuliner/i }));
  expect(screen.getByTestId("val").textContent).toBe("UMKM");
});
