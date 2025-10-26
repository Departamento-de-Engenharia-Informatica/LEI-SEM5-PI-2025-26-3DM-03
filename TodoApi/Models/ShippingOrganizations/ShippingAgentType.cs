using System;
using System.Collections.Generic;
using FrameworkDDD.Common;

namespace TodoApi.Models.ShippingOrganizations
{
    /// <summary>
    /// Value Object que representa o tipo de agente ("Owner" ou "Operator").
    /// Garante integridade e conversão transparente entre domínio e BD.
    /// </summary>
    public sealed class ShippingAgentType : ValueObject
    {
        public string Value { get; private set; }

        // Lista de tipos válidos (case-insensitive)
        private static readonly HashSet<string> AllowedTypes =
            new(new[] { "Owner", "Operator" }, StringComparer.OrdinalIgnoreCase);

        private ShippingAgentType()
        {
            Value = string.Empty;
        }

        public ShippingAgentType(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException("ShippingAgentType is required.", nameof(value));

            if (!AllowedTypes.Contains(value))
                throw new ArgumentException("Invalid ShippingAgentType. Allowed values: Owner, Operator.");

            // Guarda numa forma canónica
            Value = value.Equals("owner", StringComparison.OrdinalIgnoreCase)
                ? "Owner"
                : "Operator";
        }

        public static ShippingAgentType Owner => new("Owner");
        public static ShippingAgentType Operator => new("Operator");

        protected override IEnumerable<object> GetEqualityComponents()
        {
            yield return Value;
        }

        public override string ToString() => Value;

        // Conversão implícita de VO -> string
        public static implicit operator string(ShippingAgentType v) => v?.Value ?? string.Empty;

        // Conversão implícita de string -> VO
        public static implicit operator ShippingAgentType(string v) => new ShippingAgentType(v);

        // Override GetHashCode to match underlying canonical string's hashcode
        public override int GetHashCode()
        {
            return Value?.GetHashCode() ?? 0;
        }
    }
}
