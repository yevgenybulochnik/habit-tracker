// Global CSS injected once by App: keyframes, the few global utility classes,
// and app-wide resets. Component styles live in CSS Modules; theme variables
// are in theme.ts (THEME_CSS).
export const CSS = `
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.stagger-child{animation:fadeUp .7s cubic-bezier(.16,1,.3,1) both}
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
/* The slide between pages (see slide.ts), only while data-slide is set: the
   page on top covers the one beneath (no cross-fade's blend), which moves a
   third as far and dims, as on iOS. */
:root[data-slide]::view-transition-old(root),:root[data-slide]::view-transition-new(root){animation-duration:.38s;animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-fill-mode:both;mix-blend-mode:normal}
:root[data-slide=forward]::view-transition-old(root){animation-name:slide-out-left}
:root[data-slide=forward]::view-transition-new(root){animation-name:slide-in-right}
:root[data-slide=back]::view-transition-old(root){animation-name:slide-out-right}
:root[data-slide=back]::view-transition-new(root){animation-name:slide-in-left}
:root[data-slide=forward]::view-transition-new(root),:root[data-slide=back]::view-transition-old(root){z-index:1;box-shadow:-12px 0 32px rgba(0,0,0,.35)}
@keyframes slide-out-left{to{transform:translateX(-30%);filter:brightness(.6)}}
@keyframes slide-in-left{from{transform:translateX(-30%);filter:brightness(.6)}}
@keyframes slide-in-right{from{transform:translateX(100%)}}
@keyframes slide-out-right{to{transform:translateX(100%)}}
`;

// (Form input/label styles now live in src/styles/shared.module.css.)
