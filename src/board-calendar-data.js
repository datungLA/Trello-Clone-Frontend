export function businessDay(value) { return value ? value.slice(0, 10) : ""; }

export function monthCells(month) {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const length = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const date = new Date(Date.UTC(year, number - 1, 1 - offset + index));
    const key = date.toISOString().slice(0, 10);
    return { key, day: date.getUTCDate(), current: key.startsWith(month) };
  });
}

export function shiftMonth(month, amount) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7);
}

export function calendarCards(board, memberId = "") {
  return board.lists.filter(list => !list.archived).flatMap(list => list.cards.filter(card => !card.archived && (!memberId || card.assigneeIds?.includes(memberId))).map(card => ({ ...card, listTitle: list.title, calendarDate: businessDay(card.dueDate || card.startDate), startOnly: !card.dueDate && !!card.startDate }))).sort((a, b) => a.calendarDate.localeCompare(b.calendarDate) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
