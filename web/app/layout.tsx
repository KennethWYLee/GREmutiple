import type { Metadata } from "next";import "./globals.css";
export const metadata: Metadata={title:"GRE 練習室 · 每回 15 題",description:"B、C、D 題庫，十五題練習、交卷解析與個人進度。",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body>{children}</body></html>}
