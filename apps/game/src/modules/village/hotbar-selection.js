export function selectHotbarSlot(slots, clickedSlot, selectedItem) {
  const item = clickedSlot.getAttribute("data-item");
  if (!item) return selectedItem;

  for (const slot of slots) {
    slot.classList.remove("active");
    slot.setAttribute("aria-pressed", "false");
  }

  if (selectedItem === item) return null;

  clickedSlot.classList.add("active");
  clickedSlot.setAttribute("aria-pressed", "true");
  return item;
}
