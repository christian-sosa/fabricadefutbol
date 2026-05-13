import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhotoUploadInput } from "@/components/admin/photo-upload-input";

describe("PhotoUploadInput", () => {
  it("mantiene el input compacto con la misma altura que los controles de la planilla", () => {
    const { container } = render(<PhotoUploadInput compact hint="Foto" />);
    const wrapper = container.firstElementChild;
    const input = container.querySelector('input[type="file"]');

    expect(wrapper).toHaveClass("min-w-0");
    expect(input).toHaveClass("h-[38px]");
  });
});
