import _ from "lodash";
const _html_no_properties_found = 'no relevant properties found';

/**
 * create tooltip-overlay with options and content
 */
export function overlay(html) {
  return {
    position: { top: -30, left: 0 },
    scale: false,
    show: { maxZoom: 2 },
    html: html
  }
}


/**
 * add tooltip header
 */
export function tooltipHeader(element) {
  // .split(':')[1] is used to transform 'bpmn:ServiceTask' into 'ServiceTask'
  return '<div class="tooltip-header"> \
              <div class="tooltip-container">'+ element.type.split(':')[1] + '</div>\
            </div>';
}


/**
 * show some hint in tooltip, if no relevant property was found,
 * otherwise join all lines that include some information
 */
export function emptyPropertiesIfNoLines(lines) {
  var final = _.without(lines, "");
  if (final.length == 0) {
    return `<div class="tooltip-no-properties">${_html_no_properties_found}</div>`;
  }
  return final.join('');
}