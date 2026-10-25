import test from "node:test";
import assert from "node:assert/strict";
import { mensagemDeErro } from "../app/js/erros.js";

test("senha errada mostra a mensagem de senha", () => {
  const err = Object.assign(new Error("The operation failed"), { name: "OperationError" });
  assert.equal(mensagemDeErro(err), "Senha não confere. Confira com a Voltec.");
});

test("falha de rede mostra a mensagem de internet", () => {
  assert.equal(
    mensagemDeErro(new TypeError("Failed to fetch")),
    "Precisa de internet na primeira vez para baixar as obras.",
  );
});
