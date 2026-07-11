import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/constants.dart';

class LgTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final bool obscureText;
  final int? maxLength;
  final TextInputType keyboardType;

  const LgTextField({
    super.key,
    required this.controller,
    required this.label,
    this.obscureText = false,
    this.maxLength,
    this.keyboardType = TextInputType.text,
  });

  @override
  State<LgTextField> createState() => _LgTextFieldState();
}

class _LgTextFieldState extends State<LgTextField> {
  final FocusNode _focusNode = FocusNode();
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() {
        _isFocused = _focusNode.hasFocus;
      });
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: _isFocused ? accentPrimary : textSecondary,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: cardSecondary,
            border: Border.all(
              color: _isFocused ? accentPrimary : borderLight,
              width: _isFocused ? 1.5 : 1.0,
            ),
            borderRadius: BorderRadius.circular(12),
            boxShadow: _isFocused
                ? [
                    BoxShadow(
                      color: accentPrimary.withValues(alpha: 0.15),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    )
                  ]
                : [],
          ),
          child: TextField(
            controller: widget.controller,
            focusNode: _focusNode,
            obscureText: widget.obscureText,
            maxLength: widget.maxLength,
            keyboardType: widget.keyboardType,
            style: GoogleFonts.inter(
              color: textPrimary,
              fontSize: 15,
            ),
            cursorColor: accentPrimary,
            decoration: const InputDecoration(
              counterText: '',
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
      ],
    );
  }
}
