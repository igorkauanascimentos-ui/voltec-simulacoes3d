// OperationError é o que o WebCrypto lança quando a senha não decifra a obra.
export function mensagemDeErro(err) {
  if (err && err.name === "OperationError") return "Senha não confere. Confira com a Voltec.";
  return "Precisa de internet na primeira vez para baixar as obras.";
}
