; Too Good — custom installer UI
; Sets sidebar and header bitmaps for the wizard pages

!macro customWelcomePage
  ; Override the MUI header image on inner pages
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\win.bmp"
  !define MUI_WELCOMEFINISHPAGE_BITMAP_NOSTRETCH
!macroend

!macro customHeader
  ; Sidebar / welcome bitmap
  !define MUI_WELCOMEFINISHPAGE_BITMAP "$%TEMP%\tg_icon_render.html"
!macroend
