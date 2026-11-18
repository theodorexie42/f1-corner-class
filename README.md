# F1 弯型 / Corner class

2026 赛季正赛的弯型小程序。中心线几何、最快圈速度、挡位各投一票，两票相同才定为低速、中速或高速。界面有中文和 English，侧栏可以改快捷键。

## 运行

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:8080

## 默认快捷键

先点一下页面。在输入框里打字时不会触发。

| 操作 | 键 |
|---|---|
| 中文 | Z |
| English | E |
| 上一站 | [ |
| 下一站 | ] |
| 下载表格 | D |

点侧栏里的按键，再按一个新键即可修改。Esc 取消。

## 数据

`public/data` 是第 1 到第 17 站（澳大利亚到新加坡，含雪邦）的中心线、速度和挡位。`public/maps` 是对应的官方赛道图，只为离线打开这套程序。

## Windows

如果 PowerShell 提示找不到 `npm`，先安装 Node.js，再开一个新窗口。

1. 打开 https://nodejs.org ，下载 Windows 的 LTS 安装包并一路默认安装。
2. 关掉现在这个 PowerShell，重新打开一个。
3. 确认安装成功：

```powershell
node -v
npm -v
```

4. 回到项目再启动：

```powershell
cd C:\Users\17941\f1-corner-class
npm install
npm run dev
```

浏览器打开 http://localhost:8080 。当前这个窗口是在安装之前打开的，就算装完了也要新开一个。
