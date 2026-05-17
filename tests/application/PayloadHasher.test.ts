import { describe, expect, it } from "vitest";
import { PayloadHasher } from "../../src/application/services/PayloadHasher.js";

describe("PayloadHasher", () => {
  const hasher = new PayloadHasher();

  it("produce el mismo hash para objetos con mismo contenido pero distinto orden de keys", () => {
    const a = { a: 1, b: { x: "hola", y: [1, 2, 3] } };
    const b = { b: { y: [1, 2, 3], x: "hola" }, a: 1 };
    expect(hasher.hash(a, "v1")).toBe(hasher.hash(b, "v1"));
  });

  it("produce hashes diferentes cuando cambia un valor", () => {
    const a = { id: "abc", value: 1 };
    const b = { id: "abc", value: 2 };
    expect(hasher.hash(a, "v1")).not.toBe(hasher.hash(b, "v1"));
  });

  it("invalida cache cuando cambia la version del prompt", () => {
    const payload = { foo: "bar" };
    expect(hasher.hash(payload, "v1")).not.toBe(hasher.hash(payload, "v2"));
  });

  it("maneja arrays de forma posicional", () => {
    expect(hasher.hash([1, 2, 3], "v1")).not.toBe(hasher.hash([3, 2, 1], "v1"));
  });

  it("trata strings vs numeros como diferentes", () => {
    expect(hasher.hash({ n: 1 }, "v1")).not.toBe(hasher.hash({ n: "1" }, "v1"));
  });

  it("genera hashes hex de 64 caracteres (SHA-256)", () => {
    const hash = hasher.hash({ x: 1 }, "v1");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maneja valores nulos y undefined", () => {
    const a = { x: null };
    const b = { x: null };
    expect(hasher.hash(a, "v1")).toBe(hasher.hash(b, "v1"));
  });
});
