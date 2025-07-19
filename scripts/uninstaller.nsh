!macro customUnInstall

  DetailPrint "Closing ${PRODUCT_NAME}..."

  FindWindow $R0 "Chrome_WidgetWin_1"
  ${If} $R0 != 0
    SendMessage $R0 0x10 0 0
    Sleep 1000
  ${EndIf}

  ExecWait 'taskkill /F /IM "${APP_FILENAME}.exe"'

  StrCpy $R2 0
  loop:
    nsExec::ExecToStack 'powershell -Command "if (Get-Process -Name ${APP_FILENAME} -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"'
    Pop $R3
    Pop $R4
    IntCmp $R3 0 done loop_continue
  loop_continue:
    Sleep 1000
    IntOp $R2 $R2 + 1
    IntCmp $R2 5 done loop

  done:

  ; LOCALAPPDATA 경로 가져오기
  System::Call 'Kernel32::GetEnvironmentVariable(t, t, i) i("LOCALAPPDATA", .R0, 260)'

  ; holo-alarm 설치 폴더 삭제
  StrCpy $R5 "$R0\Programs\${PRODUCT_NAME}"
  DetailPrint "Removing app folder: $R5"
  RMDir /r "$R5"

  ; holo-alarm-updater 폴더 삭제
  StrCpy $R6 "$R0\holo-alarm-updater"
  DetailPrint "Removing updater folder: $R6"
  RMDir /r "$R6"

  ; APPDATA(Roaming) 경로 가져오기
  System::Call 'Kernel32::GetEnvironmentVariable(t, t, i) i("APPDATA", .R0, 260)'
  StrCpy $R7 "$R0\holo-alarm"
  DetailPrint "Removing roaming app data folder: $R7"
  RMDir /r "$R7"

  ; 바로가기 삭제
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  ; 시작 프로그램 레지스트리 삭제
  DetailPrint "Removing startup registry entry..."
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${PRODUCT_NAME}"

!macroend
