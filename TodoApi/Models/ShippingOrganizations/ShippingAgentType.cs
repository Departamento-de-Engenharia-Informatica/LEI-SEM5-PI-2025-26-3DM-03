using System;
using System.Collections.Generic;

namespace TodoApi.Models.ShippingOrganizations
{
    /// <summary>
    /// Value Object que representa o tipo de agente ("Owner" ou "Operator").
    /// Garante integridade e conversão transparente entre domínio e BD.
    /// </summary>
    public sealed class ShippingAgentType
    {
        public string Value { get; }

        // Lista de tipos válidos (case-insensitive)
        private static readonly HashSet<string> AllowedTypes =
            new(new[] { "Owner", "Operator" }, StringComparer.OrdinalIgnoreCase);

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

        public override string ToString() => Value;

        // Conversão implícita de VO -> string
        public static implicit operator string(ShippingAgentType v) => v.Value;

        // Conversão implícita de string -> VO
        public static implicit operator ShippingAgentType(string v) => new ShippingAgentType(v);

        public override bool Equals(object? obj) => obj is ShippingAgentType t && t.Value == Value;
        public override int GetHashCode() => Value.GetHashCode();
    }
}
