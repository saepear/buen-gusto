/** Formato térmico compartido para impresoras físicas y controladores PDF. */
export const ESTILO_TICKET = `
[data-print-ticket]{box-sizing:border-box;width:72mm!important;max-width:100%!important;margin:0!important;padding:2mm!important;background:white!important;color:black!important;border:0!important;border-radius:0!important;box-shadow:none!important;font-family:monospace;font-size:11px!important;line-height:1.4!important;overflow-wrap:anywhere}
[data-print-ticket] *{color:black!important;box-shadow:none!important;text-shadow:none!important}
[data-print-ticket] li,[data-print-ticket] tr{break-inside:avoid}
[data-print-ticket] .flex>span.font-bold:last-child{flex-shrink:0;white-space:nowrap}
[data-print-controls]{display:none!important}
`;
