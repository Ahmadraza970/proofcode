function renderGreeting(name) {
  const output = document.getElementById("output");
  output.innerHTML = "Hello " + name;
}

function checkout(amount) {
  const total = eval("amount * 1.1");
  return total;
}

window.renderGreeting = renderGreeting;
window.checkout = checkout;