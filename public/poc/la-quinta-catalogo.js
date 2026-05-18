const WHATSAPP_PHONE = "";

const products = [
  {
    title: "Camiseta Titular 2023",
    category: "camisetas",
    stock: "Sin stock",
    description: "Edicion historica naranja con base de juego.",
    art: "shirt-orange"
  },
  {
    title: "Camiseta titular 2024",
    category: "camisetas",
    stock: "Sin stock",
    description: "Modelo negro con detalles naranjas.",
    art: "shirt-black"
  },
  {
    title: "Camiseta Titular 2025",
    category: "camisetas",
    stock: "Sin stock",
    description: "Version blanca con vivos naranja.",
    art: "shirt-white"
  },
  {
    title: "Camiseta Titular 2026",
    category: "camisetas",
    stock: "Sin stock",
    description: "Nueva piel oficial del club.",
    art: "shirt-2026"
  },
  {
    title: "Remera Oversize negra",
    category: "indumentaria",
    stock: "Consultar",
    description: "Pre-match oversize bordada oficial.",
    art: "oversize"
  },
  {
    title: "Gorra La Quinta",
    category: "accesorios",
    stock: "Consultar",
    description: "Gorra negra con marca frontal.",
    art: "cap"
  },
  {
    title: "Short oficial",
    category: "indumentaria",
    stock: "Consultar",
    description: "Short liviano para partido o entrenamiento.",
    art: "short"
  },
  {
    title: "Sticker pack",
    category: "merch",
    stock: "Consultar",
    description: "Pack de stickers para termo, compu o botella.",
    art: "stickers"
  }
];

function encodeWhatsApp(message) {
  const text = encodeURIComponent(message);
  return WHATSAPP_PHONE ? `https://wa.me/${WHATSAPP_PHONE}?text=${text}` : `https://wa.me/?text=${text}`;
}

function productSvg(type) {
  const orange = "#ff9900";
  const black = "#080705";
  const white = "#ffffff";
  const yellow = "#ffd400";
  if (type === "cap") {
    return `<svg viewBox="0 0 260 220"><path d="M58 120c8-47 47-77 94-65 31 8 52 33 59 65H58Z" fill="${black}"/><path d="M51 121h169c13 0 24 9 27 22l2 9H35l2-9c3-13 14-22 27-22Z" fill="${orange}"/><path d="M118 70h36v36h-36z" fill="${white}"/></svg>`;
  }
  if (type === "short") {
    return `<svg viewBox="0 0 260 220"><path d="M66 46h128l16 132-60 11-20-66-20 66-60-11L66 46Z" fill="${black}"/><path d="M66 46h128v30H66z" fill="${orange}"/><path d="M130 76v48" stroke="${white}" stroke-width="5"/></svg>`;
  }
  if (type === "stickers") {
    return `<svg viewBox="0 0 260 220"><rect x="54" y="48" width="58" height="58" rx="8" fill="${orange}"/><rect x="135" y="58" width="68" height="68" rx="10" fill="${black}"/><path d="M82 137h96v32H82z" fill="${yellow}"/><path d="M95 74l18 29H77l18-29Z" fill="${white}"/></svg>`;
  }
  const fill = type === "shirt-white" ? white : type === "shirt-orange" ? orange : black;
  const stripe = type === "shirt-white" ? orange : type === "shirt-orange" ? black : orange;
  const mark = type === "shirt-2026" ? yellow : white;
  return `<svg viewBox="0 0 260 220"><path d="M72 36h116l44 40-28 38-22-16v92H78V98l-22 16-28-38 44-40Z" fill="${fill}" stroke="#f1d5b4" stroke-width="2"/><path d="M102 38h20v148h-20zM140 38h20v148h-20z" fill="${stripe}"/><circle cx="165" cy="84" r="10" fill="${mark}"/></svg>`;
}

function renderProducts(filter = "todos") {
  const visible = filter === "todos" ? products : products.filter((product) => product.category === filter);
  document.querySelector("#productGrid").innerHTML = visible.map((product) => `
    <article class="product-card">
      <span class="stock-badge">${product.stock}</span>
      <div class="product-art">${productSvg(product.art)}</div>
      <h3>${product.title}</h3>
      <p>${product.description}</p>
      <a class="black-button" href="${encodeWhatsApp(`Hola La Quinta, quiero consultar por ${product.title}. Me pasan stock, precio y entrega?`)}" target="_blank" rel="noreferrer">Consultar precio</a>
    </article>
  `).join("");
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderProducts(button.dataset.filter || "todos");
  });
});

document.querySelector("[data-whatsapp-general]").href = encodeWhatsApp("Hola La Quinta, quiero hacer una consulta.");
document.querySelector("[data-featured-whatsapp]").href = encodeWhatsApp("Hola La Quinta, quiero consultar por la Remera Oversize negra. Me pasan stock, precio y entrega?");
renderProducts();
