// Unified cart tests. Run with: npm test
//
// The cart was merged from two stores (skincare keyed by id, apparel keyed by
// id+size). The merge is only safe if size-keying still separates variants
// while skincare still collapses on product id, so that is asserted directly.

import {
  addLine,
  removeLine,
  setLineQty,
  cartCount,
  cartTotal,
  lineKey,
  shippingFor,
  groupByKind,
  fromProduct,
  fromGarment,
  SHIPPING_THRESHOLD,
} from "../src/lib/cart.ts";
import { PRODUCTS } from "../src/lib/products.ts";
import { GARMENTS } from "../src/lib/fashion/products.ts";

let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}

const serum = fromProduct(PRODUCTS[0]);
const cream = fromProduct(PRODUCTS[1]);
const jacket = fromGarment(GARMENTS[0]);
const tee = fromGarment(GARMENTS[3]);

// --- adapters keep what the cart needs ------------------------------------
assert("product adapts to a skincare item", serum.kind === "skincare");
assert("garment adapts to an apparel item", jacket.kind === "apparel");
assert("skincare carries no image path", serum.image === undefined);
assert("apparel carries an image path", typeof jacket.image === "string");
assert("adapters preserve price", serum.price === PRODUCTS[0].price);
assert("adapters preserve id", jacket.id === GARMENTS[0].id);

// --- line identity ---------------------------------------------------------
assert("skincare key is the bare id", lineKey("x") === "x");
assert("apparel key includes size", lineKey("x", "M") === "x::M");
assert("different sizes are different keys", lineKey("x", "M") !== lineKey("x", "L"));

// --- adding ----------------------------------------------------------------
let cart = [];
cart = addLine(cart, serum);
assert("first add creates a line", cart.length === 1);
cart = addLine(cart, serum);
assert("re-adding skincare merges rather than duplicating", cart.length === 1);
assert("merged skincare line has qty 2", cart[0].qty === 2);

cart = addLine(cart, jacket, { size: "M" });
assert("apparel adds a separate line", cart.length === 2);
cart = addLine(cart, jacket, { size: "L" });
assert("a different size is its own line", cart.length === 3);
cart = addLine(cart, jacket, { size: "M" });
assert("same garment+size merges", cart.length === 3);
assert("merged apparel line has qty 2",
  cart.find((l) => l.item.id === jacket.id && l.size === "M").qty === 2);

// --- both kinds coexist ----------------------------------------------------
assert("skincare and apparel live in one cart",
  cart.some((l) => l.item.kind === "skincare") &&
  cart.some((l) => l.item.kind === "apparel"));
const grouped = groupByKind(cart);
assert("grouping splits by kind", grouped.skincare.length === 1 && grouped.apparel.length === 2);
assert("grouping loses nothing",
  grouped.skincare.length + grouped.apparel.length === cart.length);

// --- counts and totals span both kinds ------------------------------------
assert("count sums every line", cartCount(cart) === 2 + 2 + 1);
assert("total mixes both kinds",
  cartTotal(cart) === serum.price * 2 + jacket.price * 3);
assert("empty cart counts zero", cartCount([]) === 0);
assert("empty cart totals zero", cartTotal([]) === 0);

// --- quantity --------------------------------------------------------------
cart = setLineQty(cart, jacket.id, 5, "M");
assert("setQty targets the right size",
  cart.find((l) => l.item.id === jacket.id && l.size === "M").qty === 5);
assert("setQty leaves the other size alone",
  cart.find((l) => l.item.id === jacket.id && l.size === "L").qty === 1);
cart = setLineQty(cart, jacket.id, 0, "M");
assert("qty 0 removes only that size",
  !cart.some((l) => l.item.id === jacket.id && l.size === "M") &&
  cart.some((l) => l.item.id === jacket.id && l.size === "L"));
cart = setLineQty(cart, serum.id, -3);
assert("negative qty removes the skincare line",
  !cart.some((l) => l.item.id === serum.id));

// --- removal ---------------------------------------------------------------
let c2 = addLine(addLine([], tee, { size: "S" }), tee, { size: "M" });
c2 = removeLine(c2, tee.id, "S");
assert("remove targets one size only", c2.length === 1 && c2[0].size === "M");
c2 = removeLine(c2, "nope");
assert("removing a missing line is a no-op", c2.length === 1);

let c3 = addLine(addLine([], serum), cream);
c3 = removeLine(c3, serum.id);
assert("skincare removal needs no size", c3.length === 1 && c3[0].item.id === cream.id);

// --- shipping --------------------------------------------------------------
assert("empty cart ships free", shippingFor(0) === 0);
assert("small cart is charged", shippingFor(10) > 0);
assert("at the threshold ships free", shippingFor(SHIPPING_THRESHOLD) === 0);
assert("above the threshold ships free", shippingFor(SHIPPING_THRESHOLD + 1) === 0);
assert("just below the threshold is charged", shippingFor(SHIPPING_THRESHOLD - 0.01) > 0);

// --- purity ----------------------------------------------------------------
const original = [{ item: serum, qty: 1 }];
const snapshot = JSON.stringify(original);
addLine(original, cream);
removeLine(original, serum.id);
setLineQty(original, serum.id, 9);
assert("cart operations never mutate their input", JSON.stringify(original) === snapshot);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
