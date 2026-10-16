// Font files imported by the browser entry resolve to their URL.
declare module '*.ttf' {
  const url: string
  export default url
}

// Images: a numeric asset id under Metro (Android, iOS), a URL in the browser build.
declare module '*.png' {
  const source: number | string
  export default source
}
