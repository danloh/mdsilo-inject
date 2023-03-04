// *** Core Script - Export *** 
// modified from these scripts: https://github.com/lencx/ChatGPT/tree/main/src-tauri/src/scripts in the ChatGPT project. 
// AGPL3.0 License

var turndownPluginGfm = (function (exports) {
  'use strict';

  var highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/;

  function highlightedCodeBlock (turndownService) {
    turndownService.addRule('highlightedCodeBlock', {
      filter: function (node) {
        var firstChild = node.firstChild;
        return (
          node.nodeName === 'DIV' &&
          highlightRegExp.test(node.className) &&
          firstChild &&
          firstChild.nodeName === 'PRE'
        )
      },
      replacement: function (content, node, options) {
        var className = node.className || '';
        var language = (className.match(highlightRegExp) || [null, ''])[1];

        return (
          '\n\n' + options.fence + language + '\n' +
          node.firstChild.textContent +
          '\n' + options.fence + '\n\n'
        )
      }
    });
  }

  function strikethrough (turndownService) {
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function (content) {
        return '~' + content + '~'
      }
    });
  }

  var indexOf = Array.prototype.indexOf;
  var every = Array.prototype.every;
  var rules = {};

  rules.tableCell = {
    filter: ['th', 'td'],
    replacement: function (content, node) {
      return cell(content, node)
    }
  };

  rules.tableRow = {
    filter: 'tr',
    replacement: function (content, node) {
      var borderCells = '';
      var alignMap = { left: ':--', right: '--:', center: ':-:' };

      if (isHeadingRow(node)) {
        for (var i = 0; i < node.childNodes.length; i++) {
          var border = '---';
          var align = (
            node.childNodes[i].getAttribute('align') || ''
          ).toLowerCase();

          if (align) border = alignMap[align] || border;

          borderCells += cell(border, node.childNodes[i]);
        }
      }
      return '\n' + content + (borderCells ? '\n' + borderCells : '')
    }
  };

  rules.table = {
    // Only convert tables with a heading row.
    // Tables with no heading row are kept using `keep` (see below).
    filter: function (node) {
      return node.nodeName === 'TABLE' && isHeadingRow(node.rows[0])
    },

    replacement: function (content) {
      // Ensure there are no blank lines
      content = content.replace('\n\n', '\n');
      return '\n\n' + content + '\n\n'
    }
  };

  rules.tableSection = {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: function (content) {
      return content
    }
  };

  // A tr is a heading row if:
  // - the parent is a THEAD
  // - or if its the first child of the TABLE or the first TBODY (possibly
  //   following a blank THEAD)
  // - and every cell is a TH
  function isHeadingRow (tr) {
    var parentNode = tr.parentNode;
    return (
      parentNode.nodeName === 'THEAD' ||
      (
        parentNode.firstChild === tr &&
        (parentNode.nodeName === 'TABLE' || isFirstTbody(parentNode)) &&
        every.call(tr.childNodes, function (n) { return n.nodeName === 'TH' })
      )
    )
  }

  function isFirstTbody (element) {
    var previousSibling = element.previousSibling;
    return (
      element.nodeName === 'TBODY' && (
        !previousSibling ||
        (
          previousSibling.nodeName === 'THEAD' &&
          /^\s*$/i.test(previousSibling.textContent)
        )
      )
    )
  }

  function cell (content, node) {
    var index = indexOf.call(node.parentNode.childNodes, node);
    var prefix = ' ';
    if (index === 0) prefix = '| ';
    return prefix + content + ' |'
  }

  function tables (turndownService) {
    turndownService.keep(function (node) {
      return node.nodeName === 'TABLE' && !isHeadingRow(node.rows[0])
    });
    for (var key in rules) turndownService.addRule(key, rules[key]);
  }

  function taskListItems (turndownService) {
    turndownService.addRule('taskListItems', {
      filter: function (node) {
        return node.type === 'checkbox' && node.parentNode.nodeName === 'LI'
      },
      replacement: function (content, node) {
        return (node.checked ? '[x]' : '[ ]') + ' '
      }
    });
  }

  function gfm (turndownService) {
    turndownService.use([
      highlightedCodeBlock,
      strikethrough,
      tables,
      taskListItems
    ]);
  }

  exports.gfm = gfm;
  exports.highlightedCodeBlock = highlightedCodeBlock;
  exports.strikethrough = strikethrough;
  exports.tables = tables;
  exports.taskListItems = taskListItems;

  return exports;
}({}));

var ExportMD = (function () {
  if (!TurndownService || !turndownPluginGfm) return;
  const hljsREG = /^.*(hljs).*(language-[a-z0-9]+).*$/i;
  const gfm = turndownPluginGfm.gfm
  const turndownService = new TurndownService({
    hr: '---'
  })
    .use(gfm)
    .addRule('code', {
      filter: (node) => {
        if (node.nodeName === 'CODE' && hljsREG.test(node.classList.value)) {
          return 'code';
        }
      },
      replacement: (content, node) => {
        const classStr = node.getAttribute('class');
        if (hljsREG.test(classStr)) {
          const lang = classStr.match(/.*language-(\w+)/)[1];
          if (lang) {
            return `\`\`\`${lang}\n${content}\n\`\`\``;
          }
          return `\`\`\`\n${content}\n\`\`\``;
        }
      }
    })
    .addRule('ignore', {
      filter: ['button', 'img'],
      replacement: () => '',
    })
    .addRule('table', {
      filter: 'table',
      replacement: function(content, node) {
        return `\`\`\`${content}\n\`\`\``;
      },
    });

  return turndownService;
}({}));

async function init() {
  if (window.location.pathname === '/auth/login') return;
  const buttonOuterHTMLFallback = `<button class="btn flex justify-center gap-2 btn-neutral" id="download-png-button">Try Again</button>`;
  removeButtons();
  if (window.buttonsInterval) {
    clearInterval(window.buttonsInterval);
  }
  if (window.innerWidth < 767) return;

  const chatConf = {};
  window.buttonsInterval = setInterval(() => {
    const actionsArea = document.querySelector("form>div>div");
    if (!actionsArea) {
      return;
    }
    if (shouldAddButtons(actionsArea)) {
      let TryAgainButton = actionsArea.querySelector("button");
      if (!TryAgainButton) {
        const parentNode = document.createElement("div");
        parentNode.innerHTML = buttonOuterHTMLFallback;
        TryAgainButton = parentNode.querySelector("button");
      }
      addActionsButtons(actionsArea, TryAgainButton, chatConf);
      copyBtns();
    } else if (shouldRemoveButtons()) {
      removeButtons();
    }
  }, 1000);
}

window.addEventListener('resize', init);

const Format = {
  PNG: "png",
  PDF: "pdf",
};

function shouldRemoveButtons() {
  if (document.querySelector("form .text-2xl")) {
    return true;
  }
  return false;
}

function shouldAddButtons(actionsArea) {
  // first, check if there's a "Try Again" button and no other buttons
  const buttons = actionsArea.querySelectorAll("button");

  const hasTryAgainButton = Array.from(buttons).some((button) => {
    return !/download-/.test(button.id);
  });

  const stopBtn = buttons?.[0]?.innerText;

  if (/Stop generating/ig.test(stopBtn)) {
    return false;
  }

  if (buttons.length === 2 && (/Regenerate response/ig.test(stopBtn) || buttons[1].innerText === '')) {
    return true;
  }

  if (hasTryAgainButton && buttons.length === 1) {
    return true;
  }

  // otherwise, check if open screen is not visible
  const isOpenScreen = document.querySelector("h1.text-4xl");
  if (isOpenScreen) {
    return false;
  }

  // check if the conversation is finished and there are no share buttons
  const finishedConversation = document.querySelector("form button>svg");
  const hasShareButtons = actionsArea.querySelectorAll("button[share-ext]");
  if (finishedConversation && !hasShareButtons.length) {
    return true;
  }

  return false;
}

function removeButtons() {
  const downloadButton = document.getElementById("download-png-button");
  const downloadPdfButton = document.getElementById("download-pdf-button");
  const downloadMdButton = document.getElementById("download-markdown-button");
  if (downloadButton) {
    downloadButton.remove();
  }
  if (downloadPdfButton) {
    downloadPdfButton.remove();
  }
  if (downloadPdfButton) {
    downloadMdButton.remove();
  }
}

function addActionsButtons(actionsArea, TryAgainButton) {
  const downloadButton = TryAgainButton.cloneNode(true);
  // Export markdown
  const exportMd = TryAgainButton.cloneNode(true);
  exportMd.id = "download-markdown-button";
  downloadButton.setAttribute("share-ext", "true");
  exportMd.title = "Export Markdown";
  exportMd.innerHTML = "Markdown";
  exportMd.onclick = () => {
    exportMarkdown();
  };
  actionsArea.appendChild(exportMd);

  // Generate PNG
  downloadButton.id = "download-png-button";
  downloadButton.setAttribute("share-ext", "true");
  downloadButton.title = "Generate PNG";
  downloadButton.innerHTML = "PNG";
  downloadButton.onclick = () => {
    downloadThread();
  };
  actionsArea.appendChild(downloadButton);

  // Generate PDF
  const downloadPdfButton = TryAgainButton.cloneNode(true);
  downloadPdfButton.id = "download-pdf-button";
  downloadButton.setAttribute("share-ext", "true");
  downloadPdfButton.title = "Download PDF";
  downloadPdfButton.innerHTML = "PDF";
  downloadPdfButton.onclick = () => {
    downloadThread({ as: Format.PDF });
  };
  actionsArea.appendChild(downloadPdfButton);
}

async function exportMarkdown() {
  const content = Array.from(document.querySelectorAll('main .items-center>div')).map(i => {
    let j = i.cloneNode(true);
    if (/dark\:bg-gray-800/.test(i.getAttribute('class'))) {
      j.innerHTML = `<blockquote>${i.innerHTML}</blockquote>`;
    }
    return j.innerHTML;
  }).join('');
  const data = ExportMD?.turndown(content);
  const { id } = getName();
  await invoke('write_file', { filePath: `./notes/${id}.md`, text: data });
  await invoke("msg_dialog", {title: "Save Markdown", msg: `$HOME/notes/${id}.md`});
}

function downloadThread({ as = Format.PNG } = {}) {
  const elements = new Elements();
  elements.fixLocation();
  const pixelRatio = window.devicePixelRatio;
  const minRatio = as === Format.PDF ? 2 : 2.5;
  window.devicePixelRatio = Math.max(pixelRatio, minRatio);

  html2canvas(elements.thread, {
    letterRendering: true,
  }).then(async function (canvas) {
    elements.restoreLocation();
    window.devicePixelRatio = pixelRatio;
    const imgData = canvas.toDataURL("image/png");
    requestAnimationFrame(() => {
      if (as === Format.PDF) {
        return handlePdf(imgData, canvas, pixelRatio);
      } else {
        handleImg(imgData);
      }
    });
  });
}

async function handleImg(imgData) {
  const binaryData = atob(imgData.split("base64,")[1]);
  const data = [];
  for (let i = 0; i < binaryData.length; i++) {
    data.push(binaryData.charCodeAt(i));
  }
  const { id } = getName();
  await invoke('download_file', { filePath: `./notes/${id}.png`, blob: data });
  await invoke("msg_dialog", {title: "Save PNG", msg: `$HOME/notes/${id}.png`});
}

async function handlePdf(imgData, canvas, pixelRatio) {
  const { jsPDF } = window.jspdf;
  const orientation = canvas.width > canvas.height ? "l" : "p";
  var pdf = new jsPDF(orientation, "pt", [
    canvas.width / pixelRatio,
    canvas.height / pixelRatio,
  ]);
  var pdfWidth = pdf.internal.pageSize.getWidth();
  var pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, '', 'FAST');
  const { id } = getName();
  const data = pdf.__private__.getArrayBuffer(pdf.__private__.buildDocument());
  await invoke('download_file', { filePath: `./notes/${id}.pdf`, blob: Array.from(new Uint8Array(data)) });
  await invoke("msg_dialog", {title: "Save PDF", msg: `$HOME/notes/${id}.pdf`});
}

function getName() {
  const id = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const name = document.querySelector('nav .overflow-y-auto a.hover\\:bg-gray-800')?.innerText?.trim() || '';
  return { id: name ? `${name}-${id}` : id };
}

class Elements {
  constructor() {
    this.init();
  }
  init() {
    // this.threadWrapper = document.querySelector(".cdfdFe");
    this.spacer = document.querySelector("[class*='h-48'].w-full.flex-shrink-0");
    this.thread = document.querySelector(
      "[class*='react-scroll-to-bottom']>[class*='react-scroll-to-bottom']>div"
    );

    // fix: old chat https://github.com/lencx/ChatGPT/issues/185
    if (!this.thread) {
      this.thread = document.querySelector("main .overflow-y-auto");
    }

    // h-full overflow-y-auto
    this.positionForm = document.querySelector("form").parentNode;
    // this.styledThread = document.querySelector("main");
    // this.threadContent = document.querySelector(".gAnhyd");
    this.scroller = Array.from(
      document.querySelectorAll('[class*="react-scroll-to"]')
    ).filter((el) => el.classList.contains("h-full"))[0];

    // fix: old chat
    if (!this.scroller) {
      this.scroller = document.querySelector('main .overflow-y-auto');
    }

    this.hiddens = Array.from(document.querySelectorAll(".overflow-hidden"));
    this.images = Array.from(document.querySelectorAll("img[srcset]"));
  }
  fixLocation() {
    this.hiddens.forEach((el) => {
      el.classList.remove("overflow-hidden");
    });
    this.spacer.style.display = "none";
    this.thread.style.maxWidth = "960px";
    this.thread.style.marginInline = "auto";
    this.positionForm.style.display = "none";
    this.scroller.classList.remove("h-full");
    this.scroller.style.minHeight = "100vh";
    this.images.forEach((img) => {
      const srcset = img.getAttribute("srcset");
      img.setAttribute("srcset_old", srcset);
      img.setAttribute("srcset", "");
    });
    //Fix to the text shifting down when generating the canvas
    document.body.style.lineHeight = "0.5";
  }
  restoreLocation() {
    this.hiddens.forEach((el) => {
      el.classList.add("overflow-hidden");
    });
    this.spacer.style.display = null;
    this.thread.style.maxWidth = null;
    this.thread.style.marginInline = null;
    this.positionForm.style.display = null;
    this.scroller.classList.add("h-full");
    this.scroller.style.minHeight = null;
    this.images.forEach((img) => {
      const srcset = img.getAttribute("srcset_old");
      img.setAttribute("srcset", srcset);
      img.setAttribute("srcset_old", "");
    });
    document.body.style.lineHeight = null;
  }
}

function copyBtns() {
  Array.from(document.querySelectorAll("main >div>div>div>div>div"))
    .forEach(i => {
      if (i.querySelector('.chat-item-copy')) return;
      if (!i.querySelector('button.rounded-md')) return;
      const btn = i.querySelector('button.rounded-md').cloneNode(true);
      btn.classList.add('chat-item-copy');
      btn.title = 'Copy to clipboard';
      btn.innerHTML = "Copy";
      i.querySelector('.self-end').appendChild(btn);
      btn.onclick = () => {
        copyToClipboard(i?.innerText?.trim() || '', btn);
      }
    })
}

function copyToClipboard(text, btn) {
  window.clearTimeout(window.__cpTimeout);
  btn.innerHTML = "Copy to Clip";
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    var textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.style.position = 'fixed';
    textarea.style.clip = 'rect(0 0 0 0)';
    textarea.style.top = '10px';
    textarea.value = text;
    textarea.select();
    document.execCommand('copy', true);
    document.body.removeChild(textarea);
  }
  window.__cpTimeout = setTimeout(() => {
    btn.innerHTML = "Copy";
  }, 1000);
}

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
