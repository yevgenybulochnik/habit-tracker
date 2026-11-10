// Global CSS injected once by App: keyframes, the few global utility classes,
// and app-wide resets. Component styles live in CSS Modules; theme variables
// are in theme.ts (THEME_CSS).
export const CSS = `
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes backdropIn{from{opacity:0;backdrop-filter:blur(0)}to{opacity:1;backdrop-filter:blur(4px)}}
.stagger-child{animation:fadeUp .7s cubic-bezier(.16,1,.3,1) both}
.modal-backdrop{animation:backdropIn .4s ease both}
.modal-content{animation:scaleIn .5s cubic-bezier(.16,1,.3,1) both}
/* >=16px keeps iOS Safari from auto-zooming when an input is focused.
   !important overrides the smaller inline font sizes on individual fields. */
input,select,textarea{font-size:16px !important}
/* iOS: a press-and-hold otherwise selects UI text / pops the callout menu
   (e.g. fighting the hold-to-edit gesture). The app is interactive chrome, not
   a document, so suppress selection + callout app-wide and re-enable it only
   for text fields. Inherited, so it cascades to every card/label. */
[data-theme]{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
[data-theme] input,[data-theme] textarea{-webkit-user-select:text;user-select:text}
/* iOS: while reordering, the whole drag region AND its children must disable
   touch panning, or a drag started on the icon/name is stolen by page scroll
   (touch-action isn't inherited, so cover descendants explicitly). */
.reorder-drag,.reorder-drag *{touch-action:none}
`;

// (Form input/label styles now live in src/styles/shared.module.css.)
