/** Prints only the part of the page marked `print-area` (see the print rules in index.css). */
export function printArea() {
  document.body.classList.add('printing')
  const done = () => {
    document.body.classList.remove('printing')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
  setTimeout(done, 1000)
}
