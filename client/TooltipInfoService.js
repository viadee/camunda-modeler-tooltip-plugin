'use strict';
const $ = require('jquery');
const _ = require('lodash');
const C8 = require("./CamundaCloudServiceModule");
const C7 = require("./CamundaPlatformServiceModule");
const supportedTypes = [
  'bpmn:CallActivity',
  'bpmn:BusinessRuleTask',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway',
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ManualTask',
  'bpmn:ReceiveTask',
  'bpmn:ScriptTask',
  'bpmn:SendTask',
  'bpmn:ServiceTask',
  'bpmn:SubProcess',
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent'
];
const CAMUNDA_PLATFORM_EXECUTION_PLATFORM = "Camunda Platform"
const CAMUNDA_CLOUD_EXECUTION_PLATFORM = "Camunda Cloud"

let elementOverlays = [];
let TOOLTIP_INFOS_ENABLED = true;

TooltipInfoService.$inject = [
  'eventBus',
  'overlays',
  'elementRegistry',
  'editorActions',
  'canvas'
];

function TooltipInfoService(eventBus, overlays, elementRegistry, editorActions, canvas) {

  // register 'toggleTooltipInfos'-event
  editorActions.register({
    toggleTooltipInfos: function () {
      toggleTooltipInfos();
    }
  });

  // refresh tooltips on various events
  eventBus.on('shape.added', function () { _.defer(function () { refresh(); }); });
  eventBus.on('element.changed', function () { _.defer(function () { refresh(); }); });
  eventBus.on('shape.removed', function () { _.defer(function () { refresh(); }); });

  // enable/disable tooltips
  function toggleTooltipInfos() {
    if (TOOLTIP_INFOS_ENABLED) {
      TOOLTIP_INFOS_ENABLED = false;
      overlays.remove({ type: 'tooltip-info' });
    } else {
      TOOLTIP_INFOS_ENABLED = true;
      _.defer(function () { refresh(); });
    }
  }

  /**
   * refresh all tooltips for supported bpmn-elements
   */
  function refresh() {
    if (!TOOLTIP_INFOS_ENABLED) {
      return;
    }

    _.forEach(elementRegistry.getAll(), function (element) {
      if (!supportedTypes.includes(element.type)) return;

      let id = element.id + '_tooltip_info';
      cleanTooltip(element);
      addListener(element, id);
      addTooltipDependingOnExecutionPlatform(element, id);
    });
  }

  /**
   * clean up an element from overlays
   */
  function cleanTooltip(element) {
    if (elementOverlays[element.id] !== undefined && elementOverlays[element.id].length !== 0) {
      for (let overlay in elementOverlays[element.id]) {
        overlays.remove(elementOverlays[element.id][overlay]);
      }
    }
    elementOverlays[element.id] = [];
  }

  /**
   * add listeners to an element, that are responsible for showing/hiding the
   * tooltip if the cursor hovers the element
   */
  function addListener(element, tooltipId) {
    $('[data-element-id="' + element.id + '"]')
      .on('mouseenter', function () { $('#' + tooltipId).show(); })
      .on('mouseleave', function () { $('#' + tooltipId).hide(); });
  }

  function addTooltipDependingOnExecutionPlatform(element, id) {
    let platformOfSelectedModel = canvas.getRootElement().businessObject.$parent.$attrs['modeler:executionPlatform']
    if (CAMUNDA_PLATFORM_EXECUTION_PLATFORM === platformOfSelectedModel) {
      C7.addTooltip(elementOverlays, overlays, element, id)
    }
    if (CAMUNDA_CLOUD_EXECUTION_PLATFORM === platformOfSelectedModel) {
      C8.addTooltip(elementOverlays, overlays, element, id)
    }
  }

}

module.exports = {
  __init__: ['TOOLTIP_INFO_MODULE'],
  TOOLTIP_INFO_MODULE: ['type', TooltipInfoService]
};