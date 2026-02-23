import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/p-z8-p2-w4-finance-mngr/', // เพิ่มบรรทัดนี้ (ใส่ชื่อ Repository ของคุณระหว่างเครื่องหมาย / /)
})